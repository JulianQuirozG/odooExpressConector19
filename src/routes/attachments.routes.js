const express = require('express');
const attachementController = require('../controllers/attachements.controller');
const { upload } = require('../config/multer.config');
const router = express.Router();

    //Aqui van las rutas de attachements
    router.get('/', attachementController.getAttachments);
    router.get('/:id', attachementController.getOneAttachment);
    router.post('/', upload.single('file'), attachementController.createAttachment);
    router.delete('/:id', attachementController.deleteAttachment);

module.exports = router;