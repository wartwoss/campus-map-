<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\CampusController;
use App\Http\Controllers\Controller;
use App\Models\Campus;
use App\Models\Place;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlaceController extends Controller
{
    public function index(): JsonResponse
    {
        $places = Place::orderBy('name')->get();

        return response()->json(
            $places->map(fn ($place) => $this->data($place))->values()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validated($request);
        $place = Place::create($validated + ['campus_id' => $this->campusId()]);

        return response()->json($this->data($place), 201);
    }

    public function update(Request $request, Place $place): JsonResponse
    {
        $validated = $this->validated($request);
        $place->update($validated);

        return response()->json($this->data($place));
    }

    public function destroy(Place $place): JsonResponse
    {
        $place->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    public function publish(Request $request, Place $place): JsonResponse
    {
        $place->update(['status' => 'published']);

        return response()->json($this->data($place));
    }

    public function unpublish(Request $request, Place $place): JsonResponse
    {
        $place->update(['status' => 'draft']);

        return response()->json($this->data($place));
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:200'],
            'category' => ['sometimes', 'required', 'string', 'max:50'],
            'aliases' => ['sometimes', 'nullable', 'array'],
            'description' => ['sometimes', 'nullable', 'string'],
            'details' => ['sometimes', 'nullable', 'array'],
            'building_id' => ['sometimes', 'nullable', 'integer', 'exists:buildings,id'],
            'floor_id' => ['sometimes', 'nullable', 'integer', 'exists:floors,id'],
            'position_campus' => ['sometimes', 'nullable', 'array'],
            'position_floor' => ['sometimes', 'nullable', 'array'],
            'source' => ['sometimes', 'nullable', 'string', 'max:200'],
            'verified_at' => ['sometimes', 'nullable', 'date'],
        ]);
    }

    private function campusId(): int
    {
        $campus = Campus::firstOrFail();

        return $campus->id;
    }

    private function data(Place $place): array
    {
        return app(CampusController::class)->placeData($place);
    }
}
