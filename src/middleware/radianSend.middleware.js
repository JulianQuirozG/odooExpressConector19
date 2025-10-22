
const validRadian = async (req, res, next) => {
    const body = req.body;
    try {
        if(body.event_id == 2){
            // Lógica para el evento 2
            if(!body.type_rejection_id){
                return res.status(400).json({ statusCode: 400, message: 'Para el event_id 2 es obligatorio enviar el type_rejection_id', data: [] });
            }   
        }
        next();
    } catch (error) {
        console.error('Error en validRadian middleware:', error);
        res.status(500).json({ statusCode: 500, message: 'Error en el servidor', error: error.message });
    }

};

module.exports = { validRadian };