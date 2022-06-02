import App from './App.svelte';
import auth from '../src/Firebase/firestore'
import {createUserWithEmailAndPassword } from 'firebase/auth';


const app = new App({
	target: document.body,
	props: {
		name: 'Nolene'
	}
});
  // Mounting authentication.
  // Grabbing getAuth() variable from Firebase and passing it locally to auth
  onMount(() => {
    const auth = getAuth();
    // Monitors authentication state changes.
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // If user verified open application
        console.log("Welcome to the BeMe!");
        isLoggedIn.update(() => true);
        login = true; // If the user exists authstore writeable will return true.
      } else {
        // Else redirect to login page
        isLoggedIn.update(() => false); // Ensuring authstore writable is false and user cannot login
        goto("/login"); // Navigating back to login page
        login = false; 
      }
    });
  });

export default app;


