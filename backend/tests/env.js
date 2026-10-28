// Variables para las pruebas. La BD de pruebas se BORRA y recrea en cada corrida:
// nunca apunte TEST_DB_NAME a una base con datos reales.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET_TEST || 'secreto-de-pruebas-con-mas-de-32-caracteres-0123456789';
process.env.BCRYPT_COSTO = '4';
process.env.DB_HOST = process.env.TEST_DB_HOST || 'localhost';
process.env.DB_PORT = process.env.TEST_DB_PORT || '5432';
process.env.DB_USER = process.env.TEST_DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD || 'postgres';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'seguimiento_embarazo_test';
