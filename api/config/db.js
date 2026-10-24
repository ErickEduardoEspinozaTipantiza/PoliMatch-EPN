import mongoose from "mongoose";

export async function connectDB(uri, { production = false } = {}) {
  try {
    const connection = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      autoIndex: !production,
    });
    const topology = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!topology.setName && topology.msg !== "isdbgrid") {
      await mongoose.disconnect();
      throw new Error("REPLICA_SET_REQUIRED");
    }
    return connection;
  } catch (error) {
    if (error.message === "REPLICA_SET_REQUIRED")
      throw new Error(
        "MongoDB requiere un replica set para guardar matches atómicos. Configura una réplica local o Atlas.",
      );
    // Never print driver errors: connection strings can contain credentials.
    throw new Error(
      "No se pudo conectar a MongoDB. Revisa la configuración y la disponibilidad del servicio.",
    );
  }
}
