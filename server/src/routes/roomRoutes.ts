import { Router } from 'express';
import {
  handleCreateRoom,
  handleGetRooms,
  handleGetRoomById,
  handleUpdateVideo,
  handleUpdateParticipantRole,
  handleJoinRoom,
  handleLeaveRoom,
  handleDeleteRoom,
  handleGetParticipants,
} from '../controllers/roomController';
import {
  handleCreateJoinRequest,
  handleGetPendingRequests,
  handleDecideJoinRequest,
  handleGetUserRequestStatus,
} from '../controllers/approvalController';
import { requireAuth } from '../middleware/auth';
import { requireRoomHost, requireRoomModeratorOrHost } from '../middleware/roomAuth';
import { validate } from '../middleware/validate';
import { createRoomSchema, joinRoomSchema } from '../validation/roomValidation';

const router = Router();

// Protect all room endpoints with user session auth
router.use(requireAuth);

router.post('/', validate(createRoomSchema), handleCreateRoom);
router.get('/', handleGetRooms);
router.post('/join', validate(joinRoomSchema), handleJoinRoom);

router.get('/:roomId', handleGetRoomById);
router.patch('/:roomId/video', requireRoomModeratorOrHost, handleUpdateVideo);
router.patch('/:roomId/participants/:targetUserId/role', requireRoomHost, handleUpdateParticipantRole);
router.post('/:roomId/leave', handleLeaveRoom);
router.get('/:roomId/participants', handleGetParticipants);

// Participant Approval Routes
router.post('/:roomId/request-access', handleCreateJoinRequest);
router.get('/:roomId/requests', handleGetPendingRequests);
router.get('/:roomId/request-status', handleGetUserRequestStatus);
router.patch('/requests/:requestId', handleDecideJoinRequest);

router.delete('/:roomId', requireRoomHost, handleDeleteRoom);

export default router;
