import rateLimit from 'express-rate-limit';


export const apiLimiter = rateLimit({
windowMs: 15 * 60 * 1000,
max: 300, 
standardHeaders: true,
legacyHeaders: false,
// Trust proxy - required when behind Nginx
validate: {
  trustProxy: true,
  xForwardedForHeader: 'X-Forwarded-For',
},
});

export const authLimiter = rateLimit({
windowMs: 15 * 60 * 1000,
max: 20,
standardHeaders: true,
legacyHeaders: false,
message: { message: "Too many authentication attempts. Please try again later." },
validate: {
  trustProxy: true,
  xForwardedForHeader: 'X-Forwarded-For',
},
});


