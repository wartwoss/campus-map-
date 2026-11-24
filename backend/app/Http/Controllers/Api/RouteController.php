<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Place;
use App\Services\NavigationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RouteController extends Controller
{
    public function __construct(private readonly NavigationService $navigation) {}

    public function compute(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['required', 'integer', 'exists:places,id'],
            'to' => ['required', 'integer', 'exists:places,id'],
            'accessible' => ['nullable', 'boolean'],
        ]);

        $from = Place::findOrFail($validated['from']);
        $to = Place::findOrFail($validated['to']);

        if (! $from->isPublished() || ! $to->isPublished()) {
            return response()->json(['message' => 'Routes can only use published places.'], 422);
        }

        $route = $this->navigation->route($from, $to, (bool) ($validated['accessible'] ?? false));

        if ($route === null) {
            return response()->json([
                'message' => 'No walkable route exists between these places in the current map data.',
            ], 422);
        }

        return response()->json($route);
    }
}
