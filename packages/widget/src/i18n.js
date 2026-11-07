// Interface words. Hints themselves stay in Russian: they explain Russian text.
export const STRINGS={
 ru:{
  title:'Замечания',close:'Закрыть',checking:'Проверяем текст…',none:'Замечаний нет.',
  serverFailed:'Орфографию проверить не получилось: {error}. Стиль проверен.',
  credit:'Подсказки — ориентир, а не правило: решать вам. Список обновляется, пока вы пишете.',
  add:'Добавить «{word}» в словарь',addFailed:'Не получилось добавить слово',
  variants:'Показать варианты',loading:'Подбираем варианты…',noVariants:'Вариантов нет',replace:'Заменить на «{word}»',
  remove:'Убрать',removeLabel:'Убрать «{text}»',apply:'Принять «{text}»',applyLabel:'Заменить «{from}» на «{to}»',
  skip:'Пропустить',skipLabel:'Пропустить замечание «{text}»',
  replaced:'Заменено на «{text}».',removed:'Убрано «{text}».',skipped:'Пропущено «{text}».',undo:'Отменить',restore:'Вернуть',
  hidden:'Пропущено замечаний: {n}.',showHidden:'Показать снова',
 },
 en:{
  title:'Suggestions',close:'Close',checking:'Checking the text…',none:'No suggestions.',
  serverFailed:'Spelling could not be checked: {error}. Style is checked.',
  credit:'Hints are a guide, not a rule: the choice is yours. The list updates as you type.',
  add:'Add “{word}” to the dictionary',addFailed:'Could not add the word',
  variants:'Show variants',loading:'Looking for variants…',noVariants:'No variants',replace:'Replace with “{word}”',
  remove:'Remove',removeLabel:'Remove “{text}”',apply:'Accept “{text}”',applyLabel:'Replace “{from}” with “{to}”',
  skip:'Skip',skipLabel:'Skip the suggestion “{text}”',
  replaced:'Replaced with “{text}”.',removed:'Removed “{text}”.',skipped:'Skipped “{text}”.',undo:'Undo',restore:'Bring back',
  hidden:'Skipped suggestions: {n}.',showHidden:'Show again',
 },
};
export function strings(lang){
 const code=lang||(typeof document!=='undefined'&&document.documentElement.lang)||'ru';
 const t=STRINGS[String(code).slice(0,2).toLowerCase()]||STRINGS.ru;
 return (key,vars={})=>t[key].replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'');
}
