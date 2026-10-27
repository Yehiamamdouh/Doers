// GET /api/admin/me -> who is signed in.
import { json } from '../../../lib/admin.js';

export const onRequestGet = ({ data }) => json({ email: data.email });
