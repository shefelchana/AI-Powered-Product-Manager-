// Импортировать ПЕРВЫМ в тестах, которым нужна база: импорты в ES-модулях
// поднимаются наверх, и process.env, выставленный в теле файла, до db.js не доходит.
process.env.SQLITE_STORAGE = ":memory:";
process.env.DATABASE_URL = "";
