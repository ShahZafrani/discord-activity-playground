import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { VueFire } from 'vuefire'
import { initializeApp } from 'firebase/app'
import { patchUrlMappings } from '@discord/embedded-app-sdk'

// don't worry, this isn't like other api keys
// this type of firebase api key is considered public
patchUrlMappings([{prefix: '/firestore', target: 'firestore.googleapis.com'}]);
const firebaseApp = initializeApp({
    apiKey: "AIzaSyAFpmR9YBiAW03KY2bX2LbhDloj6uTs2c4",
    authDomain: "shinderu-revived.firebaseapp.com",
    databaseURL: "https://shinderu-revived-default-rtdb.firebaseio.com",
    projectId: "shinderu-revived",
    storageBucket: "shinderu-revived.firebasestorage.app",
    messagingSenderId: "258189134895",
    appId: "1:258189134895:web:fab9db1c9f905c2d4fcada"
});
  

createApp(App)
.use(VueFire, {
    firebaseApp,
    // add modules like VueFireAuth, ...
    modules: [],
  })
  .mount('#app')
