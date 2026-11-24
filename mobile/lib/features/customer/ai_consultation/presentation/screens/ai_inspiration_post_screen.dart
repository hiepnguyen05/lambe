import 'package:flutter/material.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/screens/feed_post_screen.dart';

/// AI inspiration and the public Feed share the same visibility and booking flow.
class AiInspirationPostScreen extends StatelessWidget {
  final String postId;
  const AiInspirationPostScreen({super.key, required this.postId});
  @override
  Widget build(BuildContext context) => FeedPostScreen(id: postId);
}
