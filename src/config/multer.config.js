const multer = require('multer');
const path = require('path');

// Configuración de almacenamiento en memoria
const storage = multer.memoryStorage();

// Límite de tamaño de archivo 5MB
const limits = {
    fileSize: 5 * 1024 * 1024
};

// Exporta la instancia de multer configurada
const upload = multer({ storage, limits });


module.exports = { upload };