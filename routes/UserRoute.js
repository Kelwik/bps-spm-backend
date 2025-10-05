const express = require('express');
const router = express.Router();
const userController = require('../controllers/UserController');
const { protect } = require('../middleware/AuthMiddleware');

// Middleware to ensure only admins can access these routes
const requireAdmin = (req, res, next) => {
  if (req.user && ['op_prov', 'supervisor'].includes(req.user.role)) {
    next();
  } else {
    res
      .status(403)
      .json({ error: 'Akses ditolak. Fitur ini hanya untuk admin.' });
  }
};

// Protect all user management routes
router.use(protect, requireAdmin);

router
  .route('/')
  .get(userController.getAllUsers) // GET /api/users -> Get all users
  .post(userController.createUser); // POST /api/users -> Create a new user

router
  .route('/:id')
  .put(userController.updateUser) // PUT /api/users/:id -> Update a user
  .delete(userController.deleteUser); // DELETE /api/users/:id -> Delete a user

module.exports = router;
