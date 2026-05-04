import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react-native';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type BlogPost = {
  id: string;
  title: string;
  snippet: string;
  category: string;
  read_time_min: number;
  published_at: string;
  image_url?: string;
};

const mockBlogs: BlogPost[] = [
  {
    id: '1',
    title: 'Dumbbell vs Machine: Which Is Better?',
    snippet: 'When it comes to strength training, the debate between free weights and machines is a classic...',
    category: 'Training',
    read_time_min: 4,
    published_at: '2025-08-10T09:30:00Z',
    image_url: 'https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    id: '2',
    title: '5 Best Protein Sources for Muscle Growth',
    snippet: 'Building muscle requires more than just lifting weights. Your diet plays a crucial role...',
    category: 'Nutrition',
    read_time_min: 5,
    published_at: '2025-08-08T14:20:00Z',
    image_url: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    id: '3',
    title: 'The Importance of Rest Days',
    snippet: 'Many beginners make the mistake of training every single day. Learn why rest is essential...',
    category: 'Recovery',
    read_time_min: 3,
    published_at: '2025-08-05T11:15:00Z',
    image_url: 'https://images.pexels.com/photos/3822906/pexels-photo-3822906.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    id: '4',
    title: 'How to Perfect Your Squat Form',
    snippet: 'The squat is one of the most fundamental exercises. Here is how to do it correctly...',
    category: 'Training',
    read_time_min: 6,
    published_at: '2025-08-03T16:45:00Z',
    image_url: 'https://images.pexels.com/photos/703016/pexels-photo-703016.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
];

export default function BlogsScreen() {
  const [blogs, setBlogs] = useState<BlogPost[]>(mockBlogs);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const { data } = await supabase
        .from('blog_posts')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(20);

      if (data && data.length > 0) {
        setBlogs(data);
      }
    } catch (error) {
      console.error('Error loading blogs:', error);
    }
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <LinearGradient
      colors={[theme.colors.background, '#0A0A0A']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={24} color={theme.colors.white} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Blogs</Text>
            <Text style={styles.headerSubtitle}>Stay updated to the latest trends!</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {blogs.map((post) => (
            <TouchableOpacity
              key={post.id}
              style={styles.postCard}
              activeOpacity={0.8}
              onPress={() => router.push(`/blog/${post.id}`)}
            >
              {post.image_url && (
                <Image
                  source={{ uri: post.image_url }}
                  style={styles.postImage}
                  resizeMode="cover"
                />
              )}
              <View style={styles.postContent}>
                <Text style={styles.postTitle} numberOfLines={1}>
                  {post.title}
                </Text>
                <Text style={styles.postSnippet} numberOfLines={2}>
                  {post.snippet}
                </Text>
                <View style={styles.postMeta}>
                  <View style={styles.categoryTag}>
                    <Text style={styles.categoryText}>{post.category}</Text>
                  </View>
                  <Text style={styles.metaText}>{post.read_time_min} min read</Text>
                  <Text style={styles.metaText}>•</Text>
                  <Text style={styles.metaText}>{formatDate(post.published_at)}</Text>
                </View>
              </View>
              <ChevronRight size={20} color={theme.colors.secondary} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.white,
  },
  headerSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  postCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  postImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  postContent: {
    flex: 1,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.white,
    marginBottom: 8,
  },
  postSnippet: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.secondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  postMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryTag: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 11,
    color: theme.colors.inactive,
  },
});
