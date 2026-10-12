// Reedach server as a library: call check() in your own process, or start the HTTP API with createServer().
export {check,suggest,rules,closeChecks,CHECKS} from './check.mjs';
export {createServer,parseKeys} from './http.mjs';
export {morphCheck} from './morph.mjs';
export {words,known,misspelled,Suggester} from './spell.mjs';
