<script>
	//storing all my collections in my database in a variable 
		import {NHDataBase} from "./Firebase/firestore.js"; //Importing Firestore component that was initialised in firebase.js
		
		const colRef = collection(NHDataBase, 'Database')



		//looks at the collection colRef and retrieve and console log an array of our documents (not the data) 
		getDocs(colRef)
		.then((snapshot)=>{
		let user =[]

		//cycle through the snapshot
		snapshot.docs.forEach((doc) => {
			user.push({ ...doc.data(), id:doc.id})
		})
		console.log(user)
		}).catch(err => {
		console.log(err.message)
		})

		// console logging all the users who's firstname is number
		let username = "Number"
		const collectionRef = collection(NHDataBase,"Database")
		const userquery = query(collectionRef,where("first","==",username))
		onSnapshot(userquery,(data) => {
		console.log(
			data.docs.map((theuser) =>{
			return theuser.data();
			})
		)
		})

</script>

<!-- markup (zero or more items) goes here -->

<style>
	/* styles go here */
</style>