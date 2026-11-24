<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class MediaController extends Controller
{
    public function show(string $path): JsonResponse|Response
    {
        $clean = str_replace(['..', '\\'], ['', '/'], $path);

        if (! Storage::disk('public')->exists($clean)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        $file = Storage::disk('public')->get($clean);
        $type = Storage::disk('public')->mimeType($clean) ?: 'application/octet-stream';

        return response($file, 200, [
            'Content-Type' => $type,
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }
}
