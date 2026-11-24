<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Place;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlaceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Place::where('status', 'published');

        if ($request->filled('search')) {
            $term = '%'.str_replace('%', '\%', mb_strtolower(trim((string) $request->input('search')))).'%';
            $query->where(function ($inner) use ($term) {
                $inner->whereRaw('lower(name) like ?', [$term])
                    ->orWhereRaw('lower(description) like ?', [$term])
                    ->orWhereRaw('lower(aliases) like ?', [$term]);
            });
        }

        if ($request->filled('category')) {
            $query->where('category', $request->string('category'));
        }

        if ($request->filled('building_id')) {
            $query->where('building_id', (int) $request->input('building_id'));
        }

        if ($request->filled('floor_id')) {
            $query->where('floor_id', (int) $request->input('floor_id'));
        }

        $places = $query->orderBy('name')->limit(50)->get();

        $campus = app(CampusController::class);

        return response()->json(
            $places->map(fn ($place) => $campus->placeData($place))->values()
        );
    }

    public function show(Place $place): JsonResponse
    {
        if (! $place->isPublished() && ! request()->boolean('preview')) {
            return response()->json(['message' => 'This place is not published.'], 404);
        }

        return response()->json(app(CampusController::class)->placeData($place));
    }
}
