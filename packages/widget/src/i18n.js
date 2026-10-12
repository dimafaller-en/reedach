// Interface words. Hints themselves stay in Russian: they explain Russian text.
export const STRINGS={
 ru:{
  title:'Замечания',close:'Закрыть',checking:'Проверяем текст…',none:'Замечаний нет.',
  serverFailed:'Орфографию проверить не получилось: {error}. Стиль проверен.',
  credit:'Подсказки — ориентир, а не правило: решать вам. Список обновляется, пока вы пишете.',
  add:'Добавить «{word}» в словарь',addFailed:'Не получилось добавить слово',
  variants:'Показать варианты',loading:'Подбираем варианты…',noVariants:'Вариантов нет',replace:'Заменить на «{word}»',
 },
 en:{
  title:'Suggestions',close:'Close',checking:'Checking the text…',none:'No suggestions.',
  serverFailed:'Spelling could not be checked: {error}. Style is checked.',
  credit:'Hints are a guide, not a rule: the choice is yours. The list updates as you type.',
  add:'Add “{word}” to the dictionary',addFailed:'Could not add the word',
  variants:'Show variants',loading:'Looking for variants…',noVariants:'No variants',replace:'Replace with “{word}”',
 },
};
export function strings(lang){
 const code=lang||(typeof document!=='undefined'&&document.documentElement.lang)||'ru';
 const t=STRINGS[String(code).slice(0,2).toLowerCase()]||STRINGS.ru;
 return (key,vars={})=>t[key].replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'');
}
