import { OAuth2Client } from 'google-auth-library';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { getDatabase } from './database.js';
import { nanoid } from 'nanoid';

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

// Check if Google OAuth is properly configured
const isGoogleConfigured = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET;

if (!isGoogleConfigured) {
  console.warn('⚠️  Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
  console.warn('   Google authentication will be disabled.');
}

// Initialize Google OAuth client only if configured
export const googleClient = isGoogleConfigured ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// Configure Passport Google Strategy (only if credentials are available)
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: GOOGLE_CALLBACK_URL,
    scope: ['profile', 'email']
  }, async (accessToken, refreshToken, profile, done) => {
  try {
    const db = await getDatabase();
    const usersCollection = db.collection('users');
    
    // Check if user already exists
    let user = await usersCollection.findOne({ 
      $or: [
        { googleId: profile.id },
        { email: profile.emails[0].value.toLowerCase() }
      ]
    });

    if (user) {
      // Update existing user with Google ID if not already set
      if (!user.googleId) {
        await usersCollection.updateOne(
          { _id: user._id },
          { $set: { googleId: profile.id } }
        );
        user.googleId = profile.id;
      }
      return done(null, user);
    }

    // Create new user
    const newUser = {
      id: nanoid(),
      googleId: profile.id,
      firstName: profile.name.givenName,
      lastName: profile.name.familyName,
      email: profile.emails[0].value.toLowerCase(),
      name: profile.displayName,
      profilePicture: profile.photos[0]?.value,
      role: 'Student', // Default role for Google users
      status: 'Active', // Auto-approve Google users
      createdAt: new Date(),
      lastLoginAt: new Date(),
      isGoogleUser: true
    };

    const result = await usersCollection.insertOne(newUser);
    newUser._id = result.insertedId;
    
    return done(null, newUser);
  } catch (error) {
    console.error('Google OAuth error:', error);
    return done(error, null);
  }
  }));
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const db = await getDatabase();
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ _id: id });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Verify Google ID token (for frontend)
export async function verifyGoogleToken(token) {
  if (!isGoogleConfigured || !googleClient) {
    throw new Error('Google OAuth not configured');
  }
  
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      firstName: payload.given_name,
      lastName: payload.family_name,
      profilePicture: payload.picture,
      emailVerified: payload.email_verified
    };
  } catch (error) {
    console.error('Google token verification error:', error);
    throw new Error('Invalid Google token');
  }
}

export default passport;
