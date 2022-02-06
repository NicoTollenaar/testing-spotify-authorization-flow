const express = require("express");
const cookieParser = require('cookie-parser');
const SpotifyWebApi = require('spotify-web-api-node');
const axious = require("axios");
require('dotenv').config();
const { default: axios } = require("axios");
const app = express();
const PORT = 4000;

app.use(cookieParser());
app.use(express.static(__dirname + '/public'));

const client_id = `${process.env.CLIENT_ID}`;
const client_secret = `${process.env.CLIENT_SECRET}`; 
const redirect_uri = `${process.env.REDIRECT_URI}`;
const stateKey = 'spotify_auth_state';
const credentials = {
  clientId: client_id,
  clientSecret: client_secret,
  redirectUri: redirect_uri
}
const spotifyApi = new SpotifyWebApi(credentials);


function generateRandomString (length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  
    for (var i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  };

app.get("/login", async (req, res)=> {
  const state = generateRandomString(16);
  let queryParameters = {
      client_id,
      response_type: "code",
      redirect_uri,
      state,
      scope:'user-read-private user-read-email',
      show_dialog: true
  }
  let queryInUrlFormat = new URLSearchParams(queryParameters);
  res.cookie(stateKey, state);
  // try {
  //   const response = await axious.get("https://accounts.spotify.com/authorize?" + queryInUrlFormat);
  //   console.log("Response to axious request, response keys: ", Object.keys(response));
  //   console.log("Response to axious request, response.headers: ", response.headers);
  //   console.log("Response to axious request, response.data: ", response.data);
  //   res.send(response.data);
  // } catch (err) {
  //   console.log("Error in axios catch block:", err);
  // }
  res.redirect("https://accounts.spotify.com/authorize?" + queryInUrlFormat);
});

app.get("/callback", async (req, res)=> {
  let code = req.query.code || null;
  let state = req.query.state || null;
  let storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.send('state_mismatch');
  } else {
    try {
      res.clearCookie(stateKey);
      const postDataObject = {
      grant_type: "authorization_code",
      code,
      redirect_uri,
    }
      const postDataInURLFormat= new URLSearchParams(postDataObject);
      const postOptions = {
        headers: {
          "Authorization": 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64')),
          "Content-type": "application/x-www-form-urlencoded",
        }
      }
      const response = await axios.post("https://accounts.spotify.com/api/token", postDataInURLFormat, postOptions);
      spotifyApi.setAccessToken(response.data.access_token);
      spotifyApi.setRefreshToken(response.data.refresh_token);
      console.log("spotifyApi: ", spotifyApi);
      res.json(response.data);
    } catch(err) {
      console.log("Error in axios catch, logging keys of error: ", Object.keys(err));
    }
  }
});

app.get("/refresh-token", async (req, res)=> {
  try {
    const postDataObject = {
    grant_type: "refresh_token",
    refresh_token: spotifyApi._credentials.refreshToken
    }
    const postDataInURLFormat = new URLSearchParams(postDataObject);
    const postOptions = {
      headers: {
        "Authorization": 'Basic ' + (Buffer.from(client_id + ':' + client_secret).toString('base64')),
        "Content-type": "application/x-www-form-urlencoded",
      }
    }

    const response = await axios.post("https://accounts.spotify.com/api/token", postDataInURLFormat, postOptions);
    console.log("Axious response.data on refresh: ", response.data);
    spotifyApi.setAccessToken(response.data.access_token);
    res.json(response.data);
  } catch(err) {
    console.log("Error in axios catch, logging keys of error: ", err);
  }
});

app.get("/user-info", async (req, res) => {
  if (spotifyApi._credentials.accessToken) {
    try {
      let response = await axios.get("https://api.spotify.com/v1/me", { headers: {'Authorization': 'Bearer ' + spotifyApi._credentials.accessToken}});
      res.send(response.data);
    } catch(err) {
      console.log(err);
    }
  } else {
    res.redirect("/login");
  }
});

app.get("/playlists", async (req, res)=> {
  let userId = "";
  if (spotifyApi._credentials.accessToken) {
    try {
      let userInfo = await axios.get("https://api.spotify.com/v1/me", { headers: {'Authorization': 'Bearer ' + spotifyApi._credentials.accessToken}});
      userId = userInfo.data.id;
      let playLists = await spotifyApi.getUserPlaylists(userId);
      res.send(playLists);
    } catch(err) {
      console.log(err);
    }
  } else {
    res.sendFile(__dirname + "/public/html/index.html");
  }
});


app.listen(4000, ()=> console.log(`Server running, listening on port ${PORT}...`));