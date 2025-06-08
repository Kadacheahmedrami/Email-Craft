-- Add emailVerified column to users table for NextAuth compatibility
ALTER TABLE users ADD COLUMN email_verified TIMESTAMP;

-- Create index for better performance
CREATE INDEX idx_users_email_verified ON users(email_verified);
