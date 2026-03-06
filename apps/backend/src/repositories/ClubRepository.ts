import { prisma } from '../prisma';
import { Club } from '../entities/Club';
import type { FixedBookingSettingsByActivity } from '../entities/Club';
import { Court } from '../entities/Court';
import { ActivityType } from '../entities/ActivityType';

export class ClubRepository {

    async createClub(
        slug: string,
        name: string, 
        addressLine: string,
        city: string,
        province: string,
        country: string,
        contact: string,
        phone?: string,
        logoUrl?: string,
    clubImageUrl?: string,
        instagramUrl?: string,
        facebookUrl?: string,
        websiteUrl?: string,
        description?: string,
        lightsEnabled: boolean = false,
        lightsExtraAmount?: number | null,
        lightsFromHour?: string | null,
        professorDiscountEnabled: boolean = false,
        professorDiscountPercent?: number | null,
        fixedBookingSettingsByActivity?: FixedBookingSettingsByActivity | null,
        openingDays?: number[] | null
    ): Promise<Club> {
        const location = await this.ensureLocation(city, province, country);
        const data: any = {
            slug,
            name,
            addressLine,
            city,
            province,
            country,
            locationId: location.id,
            contactInfo: contact,
            phone,
            logoUrl,
            clubImageUrl,
            instagramUrl,
            facebookUrl,
            websiteUrl,
            description,
            lightsEnabled,
            lightsExtraAmount,
            lightsFromHour,
            openingDays,
            professorDiscountEnabled,
            professorDiscountPercent,
            fixedBookingSettingsByActivity
        };

        const saved = await prisma.club.create({ data });
        return this.mapToClub(saved);
    }

    async saveCourt(court: Court): Promise<Court> {
        const saved = await prisma.court.create({
            data: {
                name: court.name,
                isIndoor: court.isIndoor,
                surface: court.surface,
                isUnderMaintenance: court.isUnderMaintenance,
                club: { connect: { id: court.club.id } },
                ...(court.activityType?.id
                    ? { activityType: { connect: { id: court.activityType.id } } }
                    : {})
            },
            include: { club: true, activityType: true }
        });

        const club = this.mapToClub(saved.club);
        const activityType = saved.activityType
            ? new ActivityType(
                saved.activityType.id,
                saved.activityType.name,
                saved.activityType.description,
                saved.activityType.defaultDurationMinutes,
                (saved.activityType as any).clubId
            )
            : null;
        
    const newCourt = new Court(saved.id, saved.name, saved.isIndoor, saved.surface, club, saved.isUnderMaintenance, activityType);
        
        return newCourt;
    }

    async findCourtById(id: number): Promise<Court | undefined> {
        const found = await prisma.court.findUnique({
            where: { id },
            include: { club: true, activityType: true }
        });

        if (!found) return undefined;

        const club = this.mapToClub(found.club);
        const activityType = found.activityType
            ? new ActivityType(
                found.activityType.id,
                found.activityType.name,
                found.activityType.description,
                found.activityType.defaultDurationMinutes,
                (found.activityType as any).clubId
            )
            : null;
        
    const court = new Court(found.id, found.name, found.isIndoor, found.surface, club, found.isUnderMaintenance, activityType);
        return court;
    }

    // Método extra necesario para que compile el servicio
    async saveClub(club: Club): Promise<Club> {
        return this.createClub(
            club.slug,
            club.name, 
            club.addressLine,
            club.city,
            club.province,
            club.country,
            club.contactInfo,
            club.phone,
            club.logoUrl,
            club.clubImageUrl,
            club.instagramUrl,
            club.facebookUrl,
            club.websiteUrl,
            club.description,
            club.lightsEnabled,
            club.lightsExtraAmount ?? null,
            club.lightsFromHour ?? null,
            club.professorDiscountEnabled ?? false,
            club.professorDiscountPercent ?? null,
            club.fixedBookingSettingsByActivity ?? null,
            club.openingDays ?? null
        );
    }
    
    async findAllClubs(): Promise<Club[]> {
        const all = await prisma.club.findMany();
        return all.map(c => this.mapToClub(c));
    }

    async findClubById(id: number): Promise<Club | undefined> {
        const found = await prisma.club.findUnique({
            where: { id }
        });
        if (!found) return undefined;
        return this.mapToClub(found);
    }

    async findClubBySlug(slug: string): Promise<Club | undefined> {
        const found = await prisma.club.findUnique({
            where: { slug }
        });
        if (!found) return undefined;
        return this.mapToClub(found);
    }

    async updateClub(id: number, data: {
        slug?: string;
        name?: string;
        addressLine?: string;
        city?: string;
        province?: string;
        country?: string;
        locationId?: number | null;
        contactInfo?: string;
        phone?: string | null;
        logoUrl?: string | null;
    clubImageUrl?: string | null;
        instagramUrl?: string | null;
        facebookUrl?: string | null;
        websiteUrl?: string | null;
        description?: string | null;
        lightsEnabled?: boolean;
        lightsExtraAmount?: number | null;
        lightsFromHour?: string | null;
        professorDiscountEnabled?: boolean;
        professorDiscountPercent?: number | null;
        fixedBookingSettingsByActivity?: FixedBookingSettingsByActivity | null;
        openingDays?: number[] | null;
    }): Promise<Club> {
        const clubData = data as any;

        if (data.city && data.province && data.country) {
            const location = await this.ensureLocation(data.city, data.province, data.country);
            (clubData as any).locationId = location.id;
        }
        const updated = await prisma.club.update({
            where: { id },
            data: clubData as any
        });
        return this.mapToClub(updated);
    }

    private mapToClub(dbClub: any): Club {
        return new Club(
            dbClub.id,
            dbClub.slug,
            dbClub.name,
            dbClub.addressLine,
            dbClub.city,
            dbClub.province,
            dbClub.country,
            dbClub.contactInfo,
            dbClub.phone || undefined,
            dbClub.logoUrl || undefined,
            dbClub.clubImageUrl || undefined,
            dbClub.instagramUrl || undefined,
            dbClub.facebookUrl || undefined,
            dbClub.websiteUrl || undefined,
            dbClub.description || undefined,
            dbClub.lightsEnabled ?? false,
            dbClub.lightsExtraAmount ?? null,
            dbClub.lightsFromHour ?? null,
            dbClub.professorDiscountEnabled ?? false,
            dbClub.professorDiscountPercent ?? null,
            (dbClub.fixedBookingSettingsByActivity ?? null) as FixedBookingSettingsByActivity | null,
            Array.isArray(dbClub.openingDays) ? dbClub.openingDays : null,
            dbClub.createdAt,
            dbClub.updatedAt
        );
    }

    private async ensureLocation(city: string, province: string, country: string) {
        return await prisma.location.upsert({
            where: {
                city_province_country: { city, province, country }
            },
            update: {},
            create: { city, province, country }
        });
    }
    async findBySlug(slug: string) {
        return await prisma.club.findUnique({
            where: { slug }
        });
    }
}

