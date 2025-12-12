from pymongo import MongoClient

client = MongoClient("mongodb+srv://marferpv_db_user:JW9ntXFTCGu2tpio@paradigmaschatbot.zrlyhfk.mongodb.net/?appName=ParadigmasChatBot")

try:
    client.admin.command("ping")
    print("🔥 Conexión a MongoDB exitosa.")
except Exception as e:
    print("❌ Error conectando a MongoDB:", e)
