const passport=require("passport")
const GoogleStrategy=require("passport-google-oauth20").Strategy
const User=require("../models/userSchema");
const env=require("dotenv").config();




passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,//provided by gogl ecloud
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: 'http://localhost:3000/auth/google/callback'
      },
      async (accessToken, refreshToken, profile, done) => {//access google api,to get new accesstoken ,contail logged in user google profile data,callback to tell passport wheather auth successd or failed
        try {//checking existing user
          let user = await User.findOne({ 
            $or: [
              { googleId: profile.id },
              { email: profile.emails[0].value }
            ]
          });
  
          if (user) {
            if (user.isBlocked) {
              return done(null, false, { message: 'Your account has been blocked.' });
            }
  
           //user exist but dont hae google id
            if (!user.googleId) {
              user.googleId = profile.id;
              await user.save();
            }
  
            return done(null, user);//proceed with login
          } else {
            user = new User({
              name: profile.displayName,
              email: profile.emails[0].value,
              googleId: profile.id,
            });
            await user.save();
            return done(null, user);
          }
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );

  
  //passport call to store userid in the sesssion here only user id
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id, done) => {//here the details of the user
    try {
      const user = await User.findById(id);
      if (user && user.isBlocked) {
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
  
  module.exports = passport;



