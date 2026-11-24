<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'slug', 'description', 'size', 'features', 'base_image_path'])]
class Campus extends Model
{
    protected function casts(): array
    {
        return [
            'size' => 'array',
            'features' => 'array',
        ];
    }

    public function buildings(): HasMany
    {
        return $this->hasMany(Building::class);
    }

    public function places(): HasMany
    {
        return $this->hasMany(Place::class);
    }
}
