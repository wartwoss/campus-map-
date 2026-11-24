# Campus Map

A small 3D campus map with two buildings from Minnesota State University, Mankato:

- **Engineering Building** — sourced from the university's Trafton East first- and second-floor plans.
- **Medical School Building** — sourced from the Clinical Sciences Building first- and second-floor plans.

The exterior shows the two footprints, the road and walkway network around them, and lets you open either building. The interior view is ceiling-free: it shows one floor at a time, renders the original university drawing on the floor slab, and raises wall runs traced from that drawing. Each building has a two-floor selector.

## Run

```sh
cd frontend
npm install
npm run dev
```

Optional Laravel backend:

```sh
cd backend
php artisan migrate --seed
php artisan serve
```

The frontend falls back to the committed two-building data when the API is offline.

## Data and credits

- **Site geometry:** © OpenStreetMap contributors, ODbL 1.0 (`frontend/scripts/fetch-two-building-campus.mjs`).
- **Floor plans:** © Minnesota State University, Mankato, from the university's public [building floor plans](https://mankato.mnsu.edu/about-the-university/maps-and-transportation/maps-and-directions/university-area-map/building-floor-plans/) index. Check reuse terms with the university before redistribution.
- **Trees:** Kenney Nature Kit, CC0.

## Verify

```sh
cd frontend
npm run build
npm test
npx playwright test
```
