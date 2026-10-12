<?php
/**
 * Removes the plugin's only option when the plugin is deleted.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'reedach_disabled' );
