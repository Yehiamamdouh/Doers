// GET /api/admin/history -> the latest saves (commits) on the site.
import { GitHub, guard, json } from '../../../lib/admin.js';

export const onRequestGet = ({ env }) => guard(async () => json(await new GitHub(env).recentCommits(15)));
