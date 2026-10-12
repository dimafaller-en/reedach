<?php
/**
 * Plugin Name:       Reedach
 * Plugin URI:        https://dimafaller.ru/reedach/
 * Description:       Style hints for Russian text in the block editor: bureaucratese, clichés, filler words, heavy syntax, typography. The check runs in the browser, the text is not sent anywhere.
 * Version:           0.3.0
 * Requires at least: 6.5
 * Requires PHP:      7.4
 * Author:            Dima Faller
 * Author URI:        https://dimafaller.ru/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       reedach
 * Domain Path:       /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'REEDACH_VERSION', '0.3.0' );

add_action(
	'init',
	function () {
		load_plugin_textdomain( 'reedach', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
	}
);

/**
 * Rule categories: key => name. Generated from the Reedach rules by build.mjs.
 *
 * @return array<string,string>
 */
function reedach_categories() {
	static $categories = null;
	if ( null === $categories ) {
		$categories = require __DIR__ . '/includes/categories.php';
	}
	return $categories;
}

/**
 * Categories switched off on the settings page.
 *
 * @return string[]
 */
function reedach_disabled() {
	$value = get_option( 'reedach_disabled', array() );
	return is_array( $value ) ? array_values( array_intersect( $value, array_keys( reedach_categories() ) ) ) : array();
}

add_action(
	'enqueue_block_editor_assets',
	function () {
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || 'post' !== $screen->base || ! current_user_can( 'edit_posts' ) ) {
			return;
		}
		$url = plugin_dir_url( __FILE__ );
		wp_enqueue_script(
			'reedach-editor',
			$url . 'build/editor.js',
			array( 'wp-block-editor', 'wp-blocks', 'wp-components', 'wp-data', 'wp-edit-post', 'wp-editor', 'wp-element', 'wp-plugins', 'wp-preferences', 'wp-rich-text' ),
			REEDACH_VERSION . '.' . filemtime( __DIR__ . '/build/editor.js' ),
			true
		);
		$settings = array(
			'disabled' => reedach_disabled(),
			'strings'  => array(
				/* translators: %d: number of suggestions. */
				'count'     => __( 'Suggestions: %d', 'reedach' ),
				'none'      => __( 'No suggestions.', 'reedach' ),
				'highlight' => __( 'Highlight in the text', 'reedach' ),
				/* translators: %s: the suggested word. */
				'replace'   => __( 'Replace with %s', 'reedach' ),
				'credit'    => __( 'Hints are a guide, not a rule: the choice is yours. The list updates as you type. Click a hint to find it in the text, or a suggested word to put it in.', 'reedach' ),
			),
		);
		wp_add_inline_script( 'reedach-editor', 'window.reedachSettings = ' . wp_json_encode( $settings ) . ';', 'before' );
		wp_enqueue_style( 'reedach-editor', $url . 'assets/editor.css', array(), REEDACH_VERSION . '.' . filemtime( __DIR__ . '/assets/editor.css' ) );
	}
);

add_action(
	'admin_init',
	function () {
		register_setting(
			'reedach',
			'reedach_disabled',
			array(
				'type'              => 'array',
				'default'           => array(),
				'sanitize_callback' => 'reedach_sanitize_disabled',
			)
		);
	}
);

/**
 * The form sends key => '1' for checked categories and key => '0' for the rest; the option keeps the keys switched off.
 *
 * @param mixed $value Form value or an already clean list.
 * @return string[]
 */
function reedach_sanitize_disabled( $value ) {
	if ( ! is_array( $value ) ) {
		return array();
	}
	$known = array_keys( reedach_categories() );
	if ( array_values( $value ) === $value ) {
		return array_values( array_intersect( array_map( 'strval', $value ), $known ) );
	}
	$off = array();
	foreach ( $known as $key ) {
		if ( isset( $value[ $key ] ) && '1' !== $value[ $key ] ) {
			$off[] = $key;
		}
	}
	return $off;
}

add_action(
	'admin_menu',
	function () {
		add_options_page( 'Reedach', 'Reedach', 'manage_options', 'reedach', 'reedach_settings_page' );
	}
);

add_filter(
	'plugin_action_links_' . plugin_basename( __FILE__ ),
	function ( $links ) {
		array_unshift( $links, '<a href="' . esc_url( admin_url( 'options-general.php?page=reedach' ) ) . '">' . esc_html__( 'Settings', 'reedach' ) . '</a>' );
		return $links;
	}
);

/**
 * Settings → Reedach: which kinds of hints authors see.
 */
function reedach_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$off = reedach_disabled();
	?>
	<div class="wrap">
		<h1>Reedach</h1>
		<p><?php esc_html_e( 'Reedach shows style hints for Russian text in the block editor: open the Reedach panel from the editor toolbar. The check runs in the browser, the text is not sent anywhere.', 'reedach' ); ?></p>
		<form action="options.php" method="post">
			<?php settings_fields( 'reedach' ); ?>
			<h2><?php esc_html_e( 'Kinds of hints', 'reedach' ); ?></h2>
			<p><?php esc_html_e( 'Uncheck what your authors do not need. The setting applies to everyone on the site.', 'reedach' ); ?></p>
			<fieldset style="columns: 16em; margin: 1em 0;">
				<?php foreach ( reedach_categories() as $key => $name ) : ?>
					<label style="display: block; margin: 0 0 .6em; break-inside: avoid;">
						<input type="hidden" name="reedach_disabled[<?php echo esc_attr( $key ); ?>]" value="0">
						<input type="checkbox" name="reedach_disabled[<?php echo esc_attr( $key ); ?>]" value="1" <?php checked( ! in_array( $key, $off, true ) ); ?>>
						<?php echo esc_html( $name ); ?>
					</label>
				<?php endforeach; ?>
			</fieldset>
			<?php submit_button(); ?>
		</form>
		<p>
			<?php
			printf(
				/* translators: %s: link to the project site. */
				esc_html__( 'Rules, sources and the full version with a spelling server: %s', 'reedach' ),
				'<a href="https://dimafaller.ru/reedach/">dimafaller.ru/reedach</a>'
			);
			?>
		</p>
	</div>
	<?php
}
