import { createClient } from '@supabase/supabase-js';
import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        console.log(token);
        const { data, error } = await supabase.auth.getUser(token);
        console.log(error?.message)
        if (error) {
            if (error.message.includes('invalid JWT')) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }
            throw error;
        }
        if (!data.user) {
            return res.status(401).json({ error: 'User not found' });
        }
        // @ts-ignore
        req.user = data.user;
        next();
    } catch (error: any) {
        console.error('Error verifying token:', error);
        if (error.status === 403 && error.code === 'bad_jwt') {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        return res.status(500).json({ error: 'Internal server error during authentication' });
    }
};