<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'campus_id', 'building_id', 'floor_id', 'category', 'name', 'aliases',
    'description', 'details', 'position_campus', 'position_floor',
    'status', 'source', 'verified_at',
])]
class Place extends Model
{
    protected function casts(): array
    {
        return [
            'aliases' => 'array',
            'details' => 'array',
            'position_campus' => 'array',
            'position_floor' => 'array',
            'verified_at' => 'date',
        ];
    }

    public function campus(): BelongsTo
    {
        return $this->belongsTo(Campus::class);
    }

    public function building(): BelongsTo
    {
        return $this->belongsTo(Building::class);
    }

    public function floor(): BelongsTo
    {
        return $this->belongsTo(Floor::class);
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }
}
