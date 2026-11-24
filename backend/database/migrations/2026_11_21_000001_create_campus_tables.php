<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campuses', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('description')->nullable();
            $table->json('size')->nullable();          // {width, height} in campus units
            $table->json('features')->nullable();       // paths, lawns, labels for the campus map
            $table->string('base_image_path')->nullable();
            $table->timestamps();
        });

        Schema::create('buildings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campus_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('name_en')->nullable();
            $table->string('code')->nullable();
            $table->unsignedBigInteger('osm_id')->nullable();
            $table->json('footprint')->nullable();      // [[x, y], ...] campus units
            $table->unsignedInteger('visual_height')->nullable(); // meters, for the 3D stack context
            $table->boolean('navigable')->default(false);
            $table->timestamps();
        });

        Schema::create('floors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('building_id')->constrained()->cascadeOnDelete();
            $table->integer('level');                  // 0 = ground, negative = basement
            $table->string('name');
            $table->json('size')->nullable();          // {width, depth} meters, floor-local frame
            $table->json('origin')->nullable();         // {x, y} campus position of the floor frame
            $table->json('rooms')->nullable();          // [{id, name, type, place, polygon: [[x, y], ...]}]
            $table->json('doors')->nullable();          // [{id, between: [roomA, roomB], at: [x, y], width, kind}]
            $table->string('plan_status')->default('demo'); // demo | official | not_published
            $table->text('plan_source')->nullable();    // where the layout came from
            $table->string('unmapped_note')->nullable();
            $table->string('plan_image_path')->nullable();
            $table->timestamps();
        });

        Schema::create('places', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campus_id')->constrained()->cascadeOnDelete();
            $table->foreignId('building_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('floor_id')->nullable()->constrained()->nullOnDelete();
            $table->string('category');                  // cafe, printer, bus_stop, room, gate, library, ...
            $table->string('name');
            $table->json('aliases')->nullable();
            $table->text('description')->nullable();
            $table->json('details')->nullable();        // category specific: menu, timetable, shop number
            $table->json('position_campus')->nullable(); // {x, y} campus units, outdoor places
            $table->json('position_floor')->nullable();  // {x, y} floor-local meters, indoor places
            $table->string('status')->default('draft');  // draft | published
            $table->string('source')->nullable();
            $table->date('verified_at')->nullable();
            $table->timestamps();
        });

        Schema::create('nav_nodes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campus_id')->constrained()->cascadeOnDelete();
            $table->foreignId('building_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('floor_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('place_id')->nullable()->constrained()->nullOnDelete();
            $table->string('key')->unique();             // stable identifier used by edges
            $table->string('name')->nullable();
            $table->string('type');                     // outdoor | entrance | corridor | stair | elevator | poi
            $table->float('x');
            $table->float('y');
            $table->timestamps();
        });

        Schema::create('nav_edges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campus_id')->constrained()->cascadeOnDelete();
            $table->string('from_key');
            $table->string('to_key');
            $table->float('weight')->nullable();        // meters; null = computed from node positions
            $table->string('kind')->default('path');    // path | stair | elevator | indoor
            $table->boolean('accessible')->default(true); // false for stairs
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nav_edges');
        Schema::dropIfExists('nav_nodes');
        Schema::dropIfExists('places');
        Schema::dropIfExists('floors');
        Schema::dropIfExists('buildings');
        Schema::dropIfExists('campuses');
    }
};
