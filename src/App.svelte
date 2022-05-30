<script>
	export let name;
	
	console.log ("Hallo Nolene");


</script>

<main>
	<h1>Hello {name}!</h1>
	
</main>

<div class="input-group mb-3">
	<span class="input-group-text" id="name">Name</span>
	<input type="text" class="form-control" placeholder="Username" aria-label="Username" aria-describedby="basic-addon1">
  </div>
<div class="input-group mb-3">
	<span class="input-group-text" id="surname">Surname</span>
	<input type="text" class="form-control" placeholder="Username" aria-label="Username" aria-describedby="basic-addon1">
  </div>


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