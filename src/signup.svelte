
<script>
  import auth from '../src/Firebase/firestore'
  import {createUserWithEmailAndPassword } from 'firebase/auth';
  


  //grab signup form below 
  const signupForm = document.querySelector('.signup')
  signupForm.addEventListener('submit',(e) =>{
    e.preventDefault

    let email = document.getElementById("email").value;
    let password = document.getElementById("password").value;

    createUserWithEmailAndPassword(auth,email, password)
    .then((cred)=>{
      console.log('user succesfully created',cred.user)
      signupForm.requestFullscreen()
    })
    .catch((err) =>{
      console.log(err.message)
    })
  })

</script>


<h2>Firebase Auth</h2>
  
<form class="signup">
  <label for="email">email:</label>
  <input type="email"id="email">
  <label for="password">password:</label>
  <input type="password" id="password">
  <button>signup</button>
</form>