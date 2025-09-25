# Odoo Express API

Una API REST construida con Express.js para conectarse con Odoo y realizar operaciones CRUD sobre sus modelos.

## 🚀 Características

- **Autenticación JWT** - Sistema de autenticación seguro
- **Integración completa con Odoo** - CRUD completo para todos los modelos
- **Middleware de seguridad** - Helmet, CORS, Rate Limiting
- **Validación de datos** - Express Validator
- **Manejo de errores robusto** - Respuestas consistentes
- **Estructura modular** - Código organizado y mantenible

## 📋 Prerrequisitos

- Node.js >= 16.0.0
- npm o yarn
- Instancia de Odoo corriendo
- Credenciales válidas de Odoo

## 🛠️ Instalación

1. **Clona o descarga el proyecto**

2. **Instala las dependencias**
   ```bash
   npm install
   ```

3. **Configura las variables de entorno**
   ```bash
   cp .env.example .env
   ```
   
   Edita el archivo `.env` con tus valores:
   ```env
   PORT=3000
   ODOO_URL=http://localhost:8069
   ODOO_DB=tu_base_de_datos
   ODOO_USERNAME=tu_usuario
   ODOO_PASSWORD=tu_contraseña
   JWT_SECRET=tu_clave_secreta_jwt
   ```

4. **Inicia el servidor**
   ```bash
   # Modo desarrollo
   npm run dev
   
   # Modo producción
   npm start
   ```

## 📚 Uso de la API

### Autenticación

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "tu_usuario",
  "password": "tu_contraseña"
}
```

#### Verificar Token
```http
GET /api/auth/verify
Authorization: Bearer tu_jwt_token
```

### Operaciones con Modelos de Odoo

Todas las rutas de Odoo requieren autenticación JWT.

#### Obtener Registros
```http
GET /api/odoo/models/res.partner?limit=10&offset=0&domain=[]&fields=["name","email"]
Authorization: Bearer tu_jwt_token
```

#### Obtener Registro Específico
```http
GET /api/odoo/models/res.partner/1
Authorization: Bearer tu_jwt_token
```

#### Crear Registro
```http
POST /api/odoo/models/res.partner
Authorization: Bearer tu_jwt_token
Content-Type: application/json

{
  "name": "Nuevo Cliente",
  "email": "cliente@ejemplo.com"
}
```

#### Actualizar Registro
```http
PUT /api/odoo/models/res.partner/1
Authorization: Bearer tu_jwt_token
Content-Type: application/json

{
  "name": "Cliente Actualizado"
}
```

#### Eliminar Registro
```http
DELETE /api/odoo/models/res.partner/1
Authorization: Bearer tu_jwt_token
```

#### Búsqueda Avanzada
```http
POST /api/odoo/search
Authorization: Bearer tu_jwt_token
Content-Type: application/json

{
  "model": "res.partner",
  "domain": [["is_company", "=", true]],
  "fields": ["name", "email", "phone"],
  "limit": 50,
  "offset": 0
}
```

## 🏗️ Estructura del Proyecto

```
src/
├── app.js                 # Aplicación principal
├── config/
│   └── config.js         # Configuración central
├── controllers/          # Controladores (por implementar)
├── middleware/
│   ├── authMiddleware.js # Middleware de autenticación
│   └── errorHandler.js   # Manejo de errores
├── routes/
│   ├── authRoutes.js     # Rutas de autenticación
│   └── odooRoutes.js     # Rutas de Odoo
├── services/
│   └── odooService.js    # Servicio de conexión con Odoo
└── utils/
    └── helpers.js        # Utilidades y helpers
```

## 🔒 Seguridad

- **Helmet**: Protección contra vulnerabilidades comunes
- **CORS**: Configuración de origen cruzado
- **Rate Limiting**: Limitación de peticiones por IP
- **JWT**: Autenticación basada en tokens
- **Validación**: Validación de entrada con Express Validator

## 📋 Scripts Disponibles

```bash
npm start          # Iniciar en producción
npm run dev        # Iniciar en desarrollo (con nodemon)
npm test           # Ejecutar tests
npm run test:watch # Ejecutar tests en modo watch
npm run lint       # Ejecutar ESLint
npm run lint:fix   # Corregir errores de ESLint
```

## 🐛 Manejo de Errores

La API maneja consistentemente los errores y devuelve respuestas estructuradas:

```json
{
  "success": false,
  "error": "Descripción del error",
  "message": "Mensaje detallado",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 🚦 Códigos de Estado

- **200** - Operación exitosa
- **201** - Recurso creado
- **400** - Petición inválida
- **401** - No autenticado
- **403** - No autorizado
- **404** - Recurso no encontrado
- **429** - Demasiadas peticiones
- **500** - Error interno del servidor
- **502** - Error de conexión con Odoo

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 📞 Soporte

Si tienes preguntas o problemas:

1. Revisa la documentación
2. Busca en los issues existentes
3. Crea un nuevo issue con detalles completos

## 🔄 Changelog

### v1.0.0
- ✅ Autenticación JWT
- ✅ CRUD completo para modelos de Odoo
- ✅ Middleware de seguridad
- ✅ Manejo de errores robusto
- ✅ Documentación completa