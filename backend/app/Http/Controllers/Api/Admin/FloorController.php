<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Floor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class FloorController extends Controller
{
    public function update(Request $request, Floor $floor): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:100'],
            'size' => ['sometimes', 'required', 'array'],
            'origin' => ['sometimes', 'nullable', 'array'],
            'rooms' => ['sometimes', 'nullable', 'array'],
        ]);

        $floor->update($validated);

        return response()->json($this->data($floor));
    }

    public function uploadPlanImage(Request $request, Floor $floor): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'file', 'image', 'max:10240'],
        ]);

        $path = $request->file('image')->store('floor-plans', 'public');

        if ($floor->plan_image_path && Storage::disk('public')->exists($floor->plan_image_path)) {
            Storage::disk('public')->delete($floor->plan_image_path);
        }

        $floor->update(['plan_image_path' => $path]);

        return response()->json($this->data($floor));
    }

    private function data(Floor $floor): array
    {
        return [
            'id' => $floor->id,
            'building_id' => $floor->building_id,
            'level' => $floor->level,
            'name' => $floor->name,
            'size' => $floor->size,
            'origin' => $floor->origin,
            'rooms' => $floor->rooms,
            'plan_image_url' => $floor->plan_image_path ? media_url($floor->plan_image_path) : null,
        ];
    }
}
