<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['building_id', 'level', 'name', 'size', 'origin', 'rooms', 'doors', 'plan_status', 'plan_source', 'unmapped_note', 'plan_image_path'])]
class Floor extends Model
{
    protected function casts(): array
    {
        return [
            'size' => 'array',
            'origin' => 'array',
            'rooms' => 'array',
            'doors' => 'array',
        ];
    }

    public function building(): BelongsTo
    {
        return $this->belongsTo(Building::class);
    }

    public function places(): HasMany
    {
        return $this->hasMany(Place::class);
    }
}
