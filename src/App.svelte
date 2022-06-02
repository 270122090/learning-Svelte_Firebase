<script>
	export let name;

	console.log ("Hallo Nolene");

	import Signup from '../src/BeMe_loginform.svelte'

</script>

<!-- HTML TEMPLATE BEGINS -->
<main>
	<h1>Hallo {name}!</h1>
	This code can now:
	<p>Add Users to database</p>
	<p>Delete Users fields in document</p>
	<p>Run a query</p>

</main>
<Signup/>

<style>

	
	main {
		text-align: center;
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;
	}

	h1 {
		color: #ff3e00;
		text-transform: uppercase;
		font-size: 4em;
		font-weight: 100;
	}

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}

</style>