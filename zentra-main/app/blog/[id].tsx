import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from 'lucide-react-native';
import { theme } from '@/constants/theme';

const blogContent = {
  '1': {
    title: 'Dumbbell VS Machine: Which is better?',
    author: 'Hamza Bin Nadeem',
    content: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi congue turpis sed mauris interdum, id facilisis nibh luctus. Duis efficitur, velit a luctus viverra, lectus eros imperdiet est, non gravida ipsum eros ac massa.

Nunc condimentum purus sed velit tincidunt, in suscipit neque fermentum. Integer varius facilisis augue, sed placerat urna faucibus sit amet. Sed euismod magna sed laoreet pretium, enim sem dignissim ligula, non fermentum lectus sem et.

Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Vestibulum tortor quam, feugiat vitae, ultricies eget, tempor sit amet, ante. Donec eu libero sit amet quam egestas semper.

Aenean ultricies mi vitae est. Mauris placerat eleifend leo. Quisque sit amet est et sapien ullamcorper pharetra. Vestibulum erat wisi, condimentum sed, commodo vitae, ornare sit amet, wisi.

Aenean fermentum, elit eget tincidunt condimentum, eros ipsum rutrum orci, sagittis tempus lacus enim ac dui. Donec non enim in turpis pulvinar facilisis. Ut felis. Praesent dapibus, neque id cursus faucibus, tortor neque egestas augue, eu vulputate magna eros eu erat.

Aliquam erat volutpat. Nam dui mi, tincidunt quis, accumsan porttitor, facilisis luctus, metus. Phasellus ultrices nulla quis nibh. Quisque a lectus. Donec consectetuer ligula vulputate sem tristique cursus.`,
  },
  '2': {
    title: '5 Best Protein Sources for Muscle Growth',
    author: 'Sarah Johnson',
    content: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi congue turpis sed mauris interdum, id facilisis nibh luctus. Duis efficitur, velit a luctus viverra, lectus eros imperdiet est, non gravida ipsum eros ac massa.

Nunc condimentum purus sed velit tincidunt, in suscipit neque fermentum. Integer varius facilisis augue, sed placerat urna faucibus sit amet. Sed euismod magna sed laoreet pretium, enim sem dignissim ligula, non fermentum lectus sem et.

Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Vestibulum tortor quam, feugiat vitae, ultricies eget, tempor sit amet, ante. Donec eu libero sit amet quam egestas semper.

Aenean ultricies mi vitae est. Mauris placerat eleifend leo. Quisque sit amet est et sapien ullamcorper pharetra. Vestibulum erat wisi, condimentum sed, commodo vitae, ornare sit amet, wisi.`,
  },
  '3': {
    title: 'The Importance of Rest Days',
    author: 'Mike Thompson',
    content: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi congue turpis sed mauris interdum, id facilisis nibh luctus. Duis efficitur, velit a luctus viverra, lectus eros imperdiet est, non gravida ipsum eros ac massa.

Nunc condimentum purus sed velit tincidunt, in suscipit neque fermentum. Integer varius facilisis augue, sed placerat urna faucibus sit amet. Sed euismod magna sed laoreet pretium, enim sem dignissim ligula, non fermentum lectus sem et.

Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Vestibulum tortor quam, feugiat vitae, ultricies eget, tempor sit amet, ante.`,
  },
  '4': {
    title: 'How to Perfect Your Squat Form',
    author: 'David Chen',
    content: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi congue turpis sed mauris interdum, id facilisis nibh luctus. Duis efficitur, velit a luctus viverra, lectus eros imperdiet est, non gravida ipsum eros ac massa.

Nunc condimentum purus sed velit tincidunt, in suscipit neque fermentum. Integer varius facilisis augue, sed placerat urna faucibus sit amet. Sed euismod magna sed laoreet pretium, enim sem dignissim ligula, non fermentum lectus sem et.

Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Vestibulum tortor quam, feugiat vitae, ultricies eget, tempor sit amet, ante. Donec eu libero sit amet quam egestas semper.

Aenean ultricies mi vitae est. Mauris placerat eleifend leo. Quisque sit amet est et sapien ullamcorper pharetra.`,
  },
};

export default function BlogDetailScreen() {
  const params = useLocalSearchParams();
  const blogId = params.id as string;
  const blog = blogContent[blogId as keyof typeof blogContent];
  const router = useRouter();

  if (!blog) {
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
          </View>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Blog not found</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

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
          <Text style={styles.headerTitle}>Blogs</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.blogCard}>
            <Text style={styles.blogTitle}>{blog.title}</Text>
            <Text style={styles.blogAuthor}>by {blog.author}</Text>

            <View style={styles.contentContainer}>
              {blog.content.split('\n\n').map((paragraph, index) => (
                <Text key={index} style={styles.blogParagraph}>
                  {paragraph}
                </Text>
              ))}
            </View>
          </View>
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
  },
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.white,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  blogCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  blogTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '600',
    color: theme.colors.white,
    marginBottom: 8,
    lineHeight: 32,
  },
  blogAuthor: {
    fontSize: theme.fontSize.sm,
    fontStyle: 'italic',
    color: theme.colors.secondary,
    marginBottom: 24,
  },
  contentContainer: {
    gap: 16,
  },
  blogParagraph: {
    fontSize: theme.fontSize.md,
    color: theme.colors.secondary,
    lineHeight: 24,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.secondary,
  },
});
