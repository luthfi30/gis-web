<?php

namespace App\Filament\Resources;

use App\Filament\Resources\UserResource\Pages;
use App\Models\User;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Hash;

class UserResource extends Resource
{
    protected static ?string $model = User::class;

    protected static ?string $navigationIcon = 'heroicon-o-users';

    protected static ?string $navigationGroup = 'Filament Shield';

    /**
     * Optimasi query untuk menghindari N+1
     */
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()
            ->with(['roles'])
            ->withCount('layerPermissions');
    }

    public static function form(Form $form): Form
    {
        return $form->schema([

            Forms\Components\Section::make('Informasi Akun')
                ->schema([
                    Forms\Components\TextInput::make('name')
                        ->required(),

                    Forms\Components\TextInput::make('email')
                        ->email()
                        ->required()
                        ->unique(ignoreRecord: true),

                    Forms\Components\TextInput::make('password')
                        ->password()
                        ->dehydrateStateUsing(fn ($state) => Hash::make($state))
                        ->dehydrated(fn ($state) => filled($state))
                        ->required(fn (string $context): bool => $context === 'create'),
                ])
                ->columns(2),

            Forms\Components\Section::make('Layer Permission')
                ->description('Pilih layer mana saja yang boleh dilihat oleh user ini')
                ->schema([
                    Forms\Components\Select::make('layerPermissions')
                        ->label('Daftar Layer')
                        ->relationship('layerPermissions', 'name')
                        ->multiple()
                        ->searchable()
                        ->preload(false),
                ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('name')
                    ->searchable(),

                Tables\Columns\TextColumn::make('email')
                    ->searchable(),

                Tables\Columns\TextColumn::make('roles.name')
                    ->badge()
                    ->color('success'),

                Tables\Columns\TextColumn::make('layer_permissions_count')
                    ->label('Layer Diizinkan')
                    ->badge(),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ])
            ->defaultPaginationPageOption(25);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListUsers::route('/'),
            'create' => Pages\CreateUser::route('/create'),
            'edit' => Pages\EditUser::route('/{record}/edit'),
        ];
    }
}