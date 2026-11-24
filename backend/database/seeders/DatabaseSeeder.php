<?php

namespace Database\Seeders;

use App\Models\Building;
use App\Models\Campus;
use App\Models\Floor;
use App\Models\NavEdge;
use App\Models\NavNode;
use App\Models\Place;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Seeds the two-building Minnesota State Mankato campus from
 * data/two-building-campus.json (OpenStreetMap site geometry and
 * university-published floor plans).
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(
            ['email' => 'admin@campus.test'],
            [
                'name' => 'Campus Admin',
                'password' => 'demo-password',
                'is_admin' => true,
            ],
        );

        $path = __DIR__.'/data/two-building-campus.json';

        if (! file_exists($path)) {
            $this->command?->warn('two-building-campus.json not found. Run frontend/scripts/fetch-two-building-campus.mjs first.');

            return;
        }

        $source = json_decode((string) file_get_contents($path), true);

        if (! is_array($source)) {
            throw new \RuntimeException('two-building-campus.json could not be parsed.');
        }

        NavNode::query()->delete();
        NavEdge::query()->delete();
        Place::query()->delete();
        Floor::query()->delete();
        Building::query()->delete();
        Campus::query()->delete();

        $features = $source['campus']['features'];
        $features['bounds'] = $source['campus']['bounds'];

        $campus = new Campus;
        $campus->id = $source['campus']['id'];
        $campus->name = $source['campus']['name'];
        $campus->slug = 'mankato-two-buildings';
        $campus->description = $source['campus']['description'];
        $campus->size = $source['campus']['size'];
        $campus->features = $features;
        $campus->save();

        foreach ($source['buildings'] as $buildingData) {
            $building = new Building;
            $building->id = $buildingData['id'];
            $building->campus_id = $campus->id;
            $building->name = $buildingData['name'];
            $building->name_en = $buildingData['name_en'];
            $building->code = $buildingData['code'];
            $building->osm_id = $buildingData['osm_id'];
            $building->footprint = $buildingData['footprint'];
            $building->visual_height = $buildingData['visual_height'];
            $building->navigable = $buildingData['navigable'];
            $building->save();
        }

        foreach ($source['floors'] as $floorData) {
            $floor = new Floor;
            $floor->id = $floorData['id'];
            $floor->building_id = $floorData['building_id'];
            $floor->level = $floorData['level'];
            $floor->name = $floorData['name'];
            $floor->size = $floorData['size'];
            $floor->origin = $floorData['origin'];
            $floor->rooms = $floorData['rooms'];
            $floor->doors = $floorData['doors'] ?? [];
            $floor->plan_status = $floorData['plan_status'] ?? 'demo';
            $floor->plan_source = $floorData['plan_source'] ?? null;
            $floor->unmapped_note = $floorData['unmapped_note'] ?? null;
            $floor->save();
        }

        foreach ($source['places'] as $placeData) {
            $place = new Place;
            $place->id = $placeData['id'];
            $place->campus_id = $campus->id;
            $place->building_id = $placeData['building_id'];
            $place->floor_id = $placeData['floor_id'];
            $place->category = $placeData['category'];
            $place->name = $placeData['name'];
            $place->aliases = $placeData['aliases'];
            $place->description = $placeData['description'];
            $place->details = $placeData['details'];
            $place->position_campus = $placeData['position_campus'];
            $place->position_floor = $placeData['position_floor'];
            $place->status = $placeData['status'];
            $place->source = $placeData['source'];
            $place->verified_at = $placeData['verified_at'];
            $place->save();
        }

        foreach ($source['graph']['nodes'] as $nodeData) {
            $node = new NavNode;
            $node->campus_id = $campus->id;
            $node->building_id = $nodeData['building_id'];
            $node->floor_id = $nodeData['floor_id'];
            $node->place_id = $nodeData['place_id'];
            $node->key = $nodeData['key'];
            $node->name = $nodeData['name'];
            $node->type = $nodeData['type'];
            $node->x = $nodeData['x'];
            $node->y = $nodeData['y'];
            $node->save();
        }

        foreach ($source['graph']['edges'] as $edgeData) {
            $edge = new NavEdge;
            $edge->campus_id = $campus->id;
            $edge->from_key = $edgeData['from_key'];
            $edge->to_key = $edgeData['to_key'];
            $edge->kind = $edgeData['kind'];
            $edge->accessible = $edgeData['accessible'];
            $edge->weight = $edgeData['weight'];
            $edge->save();
        }
    }
}
