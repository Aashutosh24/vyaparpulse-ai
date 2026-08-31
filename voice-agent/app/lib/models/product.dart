/// One line of the merchant's catalog, served by GET /api/products.
/// `aliases` are the spellings speech-to-text actually produces.
class Product {
  final String name;
  final double price;
  final List<String> aliases;

  const Product({
    required this.name,
    required this.price,
    this.aliases = const [],
  });

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        name: json['name'] as String,
        price: (json['price'] as num).toDouble(),
        aliases: ((json['aliases'] as List?) ?? const []).cast<String>(),
      );

  Map<String, dynamic> toJson() =>
      {'name': name, 'price': price, 'aliases': aliases};
}
