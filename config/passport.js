const passport=require("passport")
const GoogleStrategy=require("passport-google-oauth20").Strategy
const User=require("../models/userSchema");
const env=require("dotenv").config();


// passport.use(new GoogleStrategy({
//     clientID:process.env.GOOGLE_CLIENT_ID,
//     clientSecret:process.env.GOOGLE_CLIENT_SECRET,
//     callbackURL:'http://localhost:3000/auth/google/callback'
// },

// async (accessToken,refreshToken,profile,done)=>{
//     try {
//         let user=await User.findOne({googleId:profile.id})
//         if(user){
//             return done(null,user);
//         }else{
//             user=new User({
//                 name:profile.displayName,
//                 email:profile.emails[0].value,
//                 googleId:profile.id,
//             })
//             user = await user.save();
//             return done(null,user);
//         }

        
//     } catch (error) {
//         return done(error,null)
        
//     }
// }
// ) )

// //can serialise: because to assign the users details to the session
// passport.serializeUser((user,done)=>{
//     done(null,user.id)

// })

// passport.deserializeUser((id,done)=>{
//     User.findById(id)
//     .then(user=>{
//         done(null,user)
//     })
//     .catch(err=>{
//         done(err,null)
//     })
// })


passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: 'http://localhost:3000/auth/google/callback'
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // First check if user exists
          let user = await User.findOne({ 
            $or: [
              { googleId: profile.id },
              { email: profile.emails[0].value }
            ]
          });
  
          if (user) {
            // Check if user is blocked
            if (user.isBlocked) {
              return done(null, false, { message: 'Your account has been blocked.' });
            }
  
            // If user exists with email but no googleId, update their googleId
            if (!user.googleId) {
              user.googleId = profile.id;
              await user.save();
            }
  
            return done(null, user);
          } else {
            // Create new user
            user = new User({
              name: profile.displayName,
              email: profile.emails[0].value,
              googleId: profile.id,
              // Set any other default fields you need
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
  
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      // Check if user is blocked during deserialization
      if (user && user.isBlocked) {
        return done(null, false);
      }
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
  
  module.exports = passport;


module.exports=passport;

