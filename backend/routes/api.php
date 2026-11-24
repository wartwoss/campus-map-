<?php

use App\Http\Controllers\Api\Admin\FloorController as AdminFloorController;
use App\Http\Controllers\Api\Admin\PlaceController as AdminPlaceController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CampusController;
use App\Http\Controllers\Api\MediaController;
use App\Http\Controllers\Api\PlaceController;
use App\Http\Controllers\Api\RouteController;
use Illuminate\Support\Facades\Route;

Route::get('/campus', [CampusController::class, 'index']);
Route::get('/campus/{campus}', [CampusController::class, 'show']);
Route::get('/places', [PlaceController::class, 'index']);
Route::get('/places/{place}', [PlaceController::class, 'show']);
Route::post('/route', [RouteController::class, 'compute']);
Route::get('/media/{path}', [MediaController::class, 'show'])->where('path', '.*');

Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/admin/places', [AdminPlaceController::class, 'index']);
    Route::post('/admin/places', [AdminPlaceController::class, 'store']);
    Route::put('/admin/places/{place}', [AdminPlaceController::class, 'update']);
    Route::delete('/admin/places/{place}', [AdminPlaceController::class, 'destroy']);
    Route::post('/admin/places/{place}/publish', [AdminPlaceController::class, 'publish']);
    Route::post('/admin/places/{place}/unpublish', [AdminPlaceController::class, 'unpublish']);

    Route::put('/admin/floors/{floor}', [AdminFloorController::class, 'update']);
    Route::post('/admin/floors/{floor}/plan-image', [AdminFloorController::class, 'uploadPlanImage']);
});
