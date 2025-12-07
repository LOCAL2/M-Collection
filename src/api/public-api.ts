/**
 * M or new Gallery - Public API
 * 
 * API สำหรับ developer เอาไปใช้ในการพัฒนา website
 * 
 * Base URL: https://gvdsbjnorpcswhsemqum.supabase.co
 */

import { supabase } from '../lib/supabase';

export interface ImageData {
  id: string;
  filename: string;
  url: string;
  uploader_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface APIResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  total?: number;
  page?: number;
  limit?: number;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  orderBy?: 'created_at' | 'filename' | 'file_size';
  order?: 'asc' | 'desc';
}

/**
 * ดึงรูปภาพทั้งหมด
 */
export async function getAllImages(options: PaginationOptions = {}): Promise<APIResponse<ImageData[]>> {
  try {
    const {
      page = 1,
      limit = 20,
      orderBy = 'created_at',
      order = 'desc'
    } = options;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // ดึงจำนวนทั้งหมด
    const { count } = await supabase
      .from('images')
      .select('*', { count: 'exact', head: true });

    // ดึงข้อมูล
    const { data, error } = await supabase
      .from('images')
      .select('id, filename, url, uploader_name, file_size, mime_type, width, height, created_at')
      .order(orderBy, { ascending: order === 'asc' })
      .range(from, to);

    if (error) throw error;

    return {
      success: true,
      data: data as ImageData[],
      error: null,
      total: count || 0,
      page,
      limit
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * ดึงรูปภาพตาม ID
 */
export async function getImageById(id: string): Promise<APIResponse<ImageData>> {
  try {
    const { data, error } = await supabase
      .from('images')
      .select('id, filename, url, uploader_name, file_size, mime_type, width, height, created_at')
      .eq('id', id)
      .single();

    if (error) throw error;

    return {
      success: true,
      data: data as ImageData,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * ค้นหารูปภาพตามชื่อผู้อัปโหลด
 */
export async function getImagesByUploader(uploaderName: string, options: PaginationOptions = {}): Promise<APIResponse<ImageData[]>> {
  try {
    const {
      page = 1,
      limit = 20,
      orderBy = 'created_at',
      order = 'desc'
    } = options;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('images')
      .select('id, filename, url, uploader_name, file_size, mime_type, width, height, created_at', { count: 'exact' })
      .eq('uploader_name', uploaderName)
      .order(orderBy, { ascending: order === 'asc' })
      .range(from, to);

    if (error) throw error;

    return {
      success: true,
      data: data as ImageData[],
      error: null,
      total: count || 0,
      page,
      limit
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * ดึงรูปภาพแบบสุ่ม
 */
export async function getRandomImages(count: number = 10): Promise<APIResponse<ImageData[]>> {
  try {
    // ดึงทั้งหมดแล้วสุ่ม (Supabase ไม่มี random function)
    const { data, error } = await supabase
      .from('images')
      .select('id, filename, url, uploader_name, file_size, mime_type, width, height, created_at');

    if (error) throw error;

    // สุ่มเลือก
    const shuffled = (data || []).sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    return {
      success: true,
      data: selected as ImageData[],
      error: null,
      total: selected.length
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * ดึงสถิติของ Gallery
 */
export async function getGalleryStats(): Promise<APIResponse<{
  totalImages: number;
  totalUploaders: number;
  totalSize: number;
  recentUploads: number;
}>> {
  try {
    const { data, error } = await supabase
      .from('images')
      .select('uploader_name, file_size, created_at');

    if (error) throw error;

    const images = data || [];
    const uniqueUploaders = new Set(images.map(img => img.uploader_name)).size;
    const totalSize = images.reduce((sum, img) => sum + (img.file_size || 0), 0);
    
    // รูปที่อัปโหลดใน 24 ชั่วโมงที่ผ่านมา
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentUploads = images.filter(img => img.created_at > oneDayAgo).length;

    return {
      success: true,
      data: {
        totalImages: images.length,
        totalUploaders: uniqueUploaders,
        totalSize,
        recentUploads
      },
      error: null
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * ค้นหารูปภาพตามชื่อไฟล์
 */
export async function searchImages(query: string, options: PaginationOptions = {}): Promise<APIResponse<ImageData[]>> {
  try {
    const {
      page = 1,
      limit = 20,
      orderBy = 'created_at',
      order = 'desc'
    } = options;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, error, count } = await supabase
      .from('images')
      .select('id, filename, url, uploader_name, file_size, mime_type, width, height, created_at', { count: 'exact' })
      .ilike('filename', `%${query}%`)
      .order(orderBy, { ascending: order === 'asc' })
      .range(from, to);

    if (error) throw error;

    return {
      success: true,
      data: data as ImageData[],
      error: null,
      total: count || 0,
      page,
      limit
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
