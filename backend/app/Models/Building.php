<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['campus_id', 'name', 'name_en', 'code', 'osm_id', 'footprint', 'visual_height', 'navigable'])]
class Building extends Model
{
    protected function casts(): array
    {
        return [
            'footprint' => 'array',
            'navigable' => 'boolean',
        ];
    }

    public function campus(): BelongsTo
    {
        return $this->belongsTo(Campus::class);
    }

    public function floors(): HasMany
    {
        return $this->hasMany(Floor::class)->orderBy('level');
    }
}
