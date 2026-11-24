<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Campus;
use App\Models\NavEdge;
use App\Models\NavNode;
use App\Models\Place;
use Illuminate\Http\JsonResponse;

class CampusController extends Controller
{
    public function index(): JsonResponse
    {
        $campus = Campus::first();

        if (! $campus) {
            return response()->json(['message' => 'No campus data has been loaded yet.'], 404);
        }

        return response()->json($this->payload($campus));
    }

    public function show(Campus $campus): JsonResponse
    {
        return response()->json($this->payload($campus));
    }

    private function payload(Campus $campus): array
    {
        $buildings = $campus->buildings()->with('floors')->orderBy('id')->get();

        return [
            'campus' => [
                'id' => $campus->id,
                'name' => $campus->name,
                'description' => $campus->description,
                'size' => $campus->size,
                'bounds' => $campus->features['bounds'] ?? null,
                'features' => $campus->features,
                'base_image_url' => $campus->base_image_path ? media_url($campus->base_image_path) : null,
            ],
            'buildings' => $buildings->map(fn ($building) => [
                'id' => $building->id,
                'osm_id' => $building->osm_id,
                'name' => $building->name,
                'name_en' => $building->name_en,
                'code' => $building->code,
                'footprint' => $building->footprint,
                'visual_height' => $building->visual_height,
                'navigable' => $building->navigable,
                'floors' => $building->floors->map(fn ($floor) => [
                    'id' => $floor->id,
                    'level' => $floor->level,
                    'name' => $floor->name,
                    'size' => $floor->size,
                    'origin' => $floor->origin,
                    'rooms' => $floor->rooms,
                    'doors' => $floor->doors,
                    'plan_status' => $floor->plan_status,
                    'plan_source' => $floor->plan_source,
                    'unmapped_note' => $floor->unmapped_note,
                    'plan_image_url' => $floor->plan_image_path ? media_url($floor->plan_image_path) : null,
                ])->values(),
            ])->values(),
            'places' => $campus->places()
                ->where('status', 'published')
                ->orderBy('name')
                ->get()
                ->map(fn ($place) => $this->placeData($place))
                ->values(),
            'graph' => [
                'nodes' => NavNode::where('campus_id', $campus->id)->get()->map(fn ($node) => [
                    'key' => $node->key,
                    'name' => $node->name,
                    'type' => $node->type,
                    'x' => $node->x,
                    'y' => $node->y,
                    'building_id' => $node->building_id,
                    'floor_id' => $node->floor_id,
                    'place_id' => $node->place_id,
                ]),
                'edges' => NavEdge::where('campus_id', $campus->id)->get()->map(fn ($edge) => [
                    'from' => $edge->from_key,
                    'to' => $edge->to_key,
                    'weight' => $edge->weight,
                    'kind' => $edge->kind,
                    'accessible' => $edge->accessible,
                ]),
            ],
        ];
    }

    public function placeData(Place $place): array
    {
        return [
            'id' => $place->id,
            'category' => $place->category,
            'name' => $place->name,
            'aliases' => $place->aliases ?? [],
            'description' => $place->description,
            'details' => $place->details,
            'building_id' => $place->building_id,
            'floor_id' => $place->floor_id,
            'position_campus' => $place->position_campus,
            'position_floor' => $place->position_floor,
            'status' => $place->status,
            'source' => $place->source,
            'verified_at' => $place->verified_at?->toDateString(),
        ];
    }
}
