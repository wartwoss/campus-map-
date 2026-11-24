<?php

namespace Tests\Feature;

use App\Models\Building;
use App\Models\Place;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed();
    }

    #[Test]
    public function campus_payload_includes_real_buildings_floors_and_places(): void
    {
        $response = $this->getJson('/api/campus');

        $response->assertOk();
        $response->assertJsonStructure([
            'campus' => ['id', 'name', 'size', 'bounds', 'features'],
            'buildings' => [
                '*' => ['id', 'name', 'name_en', 'footprint', 'navigable', 'floors'],
            ],
            'places' => [
                '*' => ['id', 'name', 'category', 'position_campus', 'position_floor'],
            ],
            'graph' => ['nodes', 'edges'],
        ]);

        $this->assertGreaterThanOrEqual(20, count($response->json('buildings')));
        $this->assertSame('Sapporo Gakuin University', $response->json('campus.name'));

        $gBuilding = collect($response->json('buildings'))->first(fn ($b) => $b['code'] === 'G');
        $this->assertNotNull($gBuilding);
        $this->assertCount(8, $gBuilding['floors']);
        $this->assertTrue($gBuilding['navigable']);
        $this->assertNotNull($gBuilding['floors'][0]['origin']);
    }

    #[Test]
    public function places_can_be_searched_by_name_and_alias(): void
    {
        $byName = $this->getJson('/api/places?search=cafeteria');
        $byName->assertOk();
        $this->assertContains('Cafeteria Soleil', array_column($byName->json(), 'name'));
        $this->assertContains('Cafeteria Phalanx', array_column($byName->json(), 'name'));

        $byAlias = $this->getJson('/api/places?search=printer');
        $byAlias->assertOk();
        $this->assertContains('Co-op Print Corner', array_column($byAlias->json(), 'name'));
    }

    #[Test]
    public function place_details_carry_source_and_verification(): void
    {
        $cafe = Place::where('name', 'Cafeteria Soleil')->first();

        $response = $this->getJson("/api/places/{$cafe->id}");

        $response->assertOk();
        $this->assertSame('cafe', $response->json('category'));
        $this->assertNotEmpty($response->json('details.menu'));
        $this->assertNotNull($response->json('source'));
    }

    #[Test]
    public function draft_places_are_hidden_from_the_public_api(): void
    {
        $place = Place::where('name', 'Cafeteria Soleil')->first();
        $place->update(['status' => 'draft']);

        $this->getJson('/api/places/'.$place->id)->assertNotFound();

        $list = $this->getJson('/api/places')->json();
        $this->assertNotContains('Cafeteria Soleil', array_column($list, 'name'));
    }

    #[Test]
    public function route_from_the_gate_to_the_cafeteria_crosses_the_entrance(): void
    {
        $gate = Place::where('name', 'Main Gate')->first();
        $cafe = Place::where('name', 'Cafeteria Soleil')->first();

        $response = $this->postJson('/api/route', ['from' => $gate->id, 'to' => $cafe->id]);

        $response->assertOk();
        $this->assertGreaterThan(300, $response->json('total_distance'));
        $actions = array_column($response->json('steps'), 'action');
        $this->assertContains('enter', $actions);
        $this->assertNotContains('stairs', $actions);
    }

    #[Test]
    public function accessible_routes_use_the_elevator_instead_of_stairs(): void
    {
        $cafe = Place::where('name', 'Cafeteria Soleil')->first();
        $hall = Place::where('name', 'SGU Hall')->first();

        $normal = $this->postJson('/api/route', ['from' => $cafe->id, 'to' => $hall->id])->json();
        $accessible = $this->postJson('/api/route', [
            'from' => $cafe->id,
            'to' => $hall->id,
            'accessible' => true,
        ])->json();

        $this->assertContains('stairs', array_column($normal['steps'], 'action'));
        $this->assertContains('elevator', array_column($accessible['steps'], 'action'));
        $this->assertNotContains('stairs', array_column($accessible['steps'], 'action'));
    }

    #[Test]
    public function admin_endpoints_require_authentication_and_role(): void
    {
        $this->getJson('/api/admin/places')->assertUnauthorized();

        $nonAdmin = User::create([
            'name' => 'Student',
            'email' => 'student@campus.test',
            'password' => 'student-password',
            'is_admin' => false,
        ]);
        $token = $nonAdmin->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/admin/places')
            ->assertForbidden();
    }

    #[Test]
    public function admin_can_create_edit_and_publish_a_place(): void
    {
        $admin = User::where('email', 'admin@campus.test')->first();
        $token = $admin->createToken('test')->plainTextToken;

        $gBuilding = Building::where('code', 'G')->first();
        $floor = $gBuilding->floors()->where('level', 1)->first();

        $created = $this->withToken($token)->postJson('/api/admin/places', [
            'name' => 'Study Corner',
            'category' => 'room',
            'description' => 'Quiet study area.',
            'position_floor' => ['x' => 20, 'y' => 24],
            'building_id' => $gBuilding->id,
            'floor_id' => $floor->id,
        ]);
        $created->assertCreated();
        $id = $created->json('id');

        $this->assertNotContains('Study Corner', array_column($this->getJson('/api/places')->json(), 'name'));

        $updated = $this->withToken($token)->putJson("/api/admin/places/{$id}", [
            'description' => 'Quiet study area near the lounge.',
        ]);
        $updated->assertOk();
        $this->assertSame('Quiet study area near the lounge.', $updated->json('description'));

        $this->withToken($token)->postJson("/api/admin/places/{$id}/publish")->assertOk();

        $this->assertContains('Study Corner', array_column($this->getJson('/api/places')->json(), 'name'));
    }

    #[Test]
    public function login_returns_a_token_for_the_seeded_admin(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'email' => 'admin@campus.test',
            'password' => 'demo-password',
        ]);

        $response->assertOk();
        $this->assertArrayHasKey('token', $response->json());
    }

    #[Test]
    public function login_rejects_wrong_credentials(): void
    {
        $this->postJson('/api/auth/login', [
            'email' => 'admin@campus.test',
            'password' => 'wrong-password',
        ])->assertUnprocessable();
    }
}
