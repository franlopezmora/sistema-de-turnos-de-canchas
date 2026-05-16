import { Router } from 'express';
import { BookingController } from '../controllers/BookingController';
import { BookingService } from '../services/BookingService';
import { authMiddleware } from '../middleware/AuthMiddleware';
import { BookingRepository } from '../repositories/BookingRepository';
import { CourtRepository } from '../repositories/CourtRepository';
import { UserRepository } from '../repositories/UserRepository';
import { ActivityTypeRepository } from '../repositories/ActivityTypeRepository';
import { CashRepository } from '../repositories/CashRepository';
import { ProductRepository } from '../repositories/ProductRepository';

const router = Router();

const bookingRepository = new BookingRepository();
const courtRepository = new CourtRepository();
const userRepository = new UserRepository();
const activityRepository = new ActivityTypeRepository();
const cashRepository = new CashRepository();
const productRepository = new ProductRepository();

const bookingService = new BookingService(
  bookingRepository,
  courtRepository,
  userRepository,
  activityRepository,
  cashRepository,
  productRepository
);

const bookingController = new BookingController(bookingService);

router.get('/bookings', authMiddleware, (req, res) => bookingController.getMyBookings(req, res));
router.post('/bookings/:id/cancel', authMiddleware, (req, res) => bookingController.cancelMyBooking(req, res));

export default router;
