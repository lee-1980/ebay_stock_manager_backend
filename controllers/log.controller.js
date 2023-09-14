import log from "../mongodb/models/log.js";

const writeLog = async (param) => {
    await log.create({
        type: param.type,
        description: param.description,
        date: param.date,
    });
}

const readLog = async (req, res) => {

    try {
        const {
            _end,
            _start,
        } = req.query;

        const count = await log.countDocuments({});

        const properties = await log.find({})
            .limit(_end - _start)
            .skip(_start)
            .sort({ date: -1 });

        res.header("x-total-count", count);
        res.header("Access-Control-Expose-Headers", "x-total-count");

        res.status(200).json(properties);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }

}

const deleteLog = async (req, res) => {
    try {
        const { id } = req.params;

        const logDelete = await Autoplus.findById({ _id: id })

        if (!logDelete) throw new Error("The relevant log is not existed");

        logDelete.remove();

        res.status(200).json({ message: "Log deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

export { writeLog, readLog, deleteLog };